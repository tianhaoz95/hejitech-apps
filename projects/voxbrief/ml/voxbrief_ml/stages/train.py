"""Stage `train`: LoRA fine-tuning of Qwen3-0.6B (full precision) on the built dataset, on the
DGX Spark. Loss is on the answer only. Prompts are rendered with the chat template and
`enable_thinking=False`, exactly the text the app feeds the model, so training matches inference.
Plain transformers + peft (no TRL) to keep the masking explicit."""

import json

from .. import jsonl

END = "<|im_end|>\n"  # how Qwen3's chat template closes an assistant turn


def encode(example, tokenizer, max_length):
    """input_ids and labels (-100 on the prompt), or None when the answer doesn't fit."""
    prompt = tokenizer.apply_chat_template(example["prompt"], add_generation_prompt=True,
                                           enable_thinking=False, tokenize=False)
    prompt_ids = tokenizer(prompt, add_special_tokens=False)["input_ids"]
    answer_ids = tokenizer(example["completion"] + END, add_special_tokens=False)["input_ids"]
    if len(prompt_ids) + len(answer_ids) > max_length:
        return None
    return {"input_ids": prompt_ids + answer_ids, "labels": [-100] * len(prompt_ids) + answer_ids}


class Collator:
    def __init__(self, pad_id):
        self.pad_id = pad_id

    def __call__(self, batch):
        import torch

        width = max(len(item["input_ids"]) for item in batch)
        ids, labels, mask = [], [], []
        for item in batch:
            pad = width - len(item["input_ids"])
            ids.append(item["input_ids"] + [self.pad_id] * pad)
            labels.append(item["labels"] + [-100] * pad)
            mask.append([1] * len(item["input_ids"]) + [0] * pad)
        return {"input_ids": torch.tensor(ids), "labels": torch.tensor(labels), "attention_mask": torch.tensor(mask)}


def run_stage(run, limit=None):
    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

    config = run["train"]
    tokenizer = AutoTokenizer.from_pretrained(config["base_model"])
    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id

    def load(split):
        examples = jsonl.read(run.path(f"dataset/{split}.jsonl"))[:limit]
        encoded = [e for e in (encode(x, tokenizer, config["max_length"]) for x in examples) if e]
        print(f"train: {split} {len(encoded)} examples ({len(examples) - len(encoded)} too long, skipped)")
        return encoded

    train, val = load("train"), load("val")
    model = AutoModelForCausalLM.from_pretrained(config["base_model"], torch_dtype=torch.bfloat16)
    model = get_peft_model(model, LoraConfig(
        r=config["lora_r"], lora_alpha=config["lora_alpha"], lora_dropout=config["lora_dropout"],
        target_modules=config["target_modules"], task_type="CAUSAL_LM",
    ))
    model.print_trainable_parameters()

    out = run.path("checkpoints")
    args = TrainingArguments(
        output_dir=str(out),
        num_train_epochs=config["epochs"],
        learning_rate=config["learning_rate"],
        per_device_train_batch_size=config["batch_size"],
        per_device_eval_batch_size=config["batch_size"],
        gradient_accumulation_steps=config["gradient_accumulation"],
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        bf16=True,
        logging_steps=10,
        eval_strategy="steps" if val else "no",
        eval_steps=config["eval_steps"],
        save_strategy="steps",
        save_steps=config["eval_steps"],
        save_total_limit=2,
        load_best_model_at_end=bool(val),
        metric_for_best_model="eval_loss",
        report_to="none",
        seed=run["run"]["seed"],
    )
    trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=val or None,
                      data_collator=Collator(pad_id))
    trainer.train()
    adapter = run.path("adapter")
    model.save_pretrained(adapter)
    tokenizer.save_pretrained(adapter)
    (adapter / "training_log.json").write_text(json.dumps(trainer.state.log_history, indent=2) + "\n")
    print(f"train: LoRA adapter -> {adapter}")
