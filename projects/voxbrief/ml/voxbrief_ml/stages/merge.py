"""Stage `merge`: folds the LoRA adapter into the base weights and saves a plain Hugging Face
model (bf16) that `convert` quantizes for the app."""


def run_stage(run, limit=None):
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, GenerationConfig

    base_id = run["train"]["base_model"]
    base = AutoModelForCausalLM.from_pretrained(base_id, torch_dtype=torch.bfloat16)
    merged = PeftModel.from_pretrained(base, run.path("adapter")).merge_and_unload()
    out = run.path("merged")
    merged.save_pretrained(out, safe_serialization=True)
    AutoTokenizer.from_pretrained(base_id).save_pretrained(out)
    GenerationConfig.from_pretrained(base_id).save_pretrained(out)
    print(f"merge: merged model -> {out}")
