// Submissions go to the Contempo Worker (POST /api/feedback, same origin), which stores them in
// Supabase (contempo.feedback). Served at /feedback/ by that Worker; no keys on this page.
const MAX_MESSAGE_LENGTH = 5000;

const form = document.getElementById("feedback-form");
const messageInput = document.getElementById("message");
const emailInput = document.getElementById("email");
// Honeypot: real users never see or fill this (visually hidden, not
// display:none — some bots skip fields that are display:none but still
// fill ones that are merely off-screen). Any non-empty value here means a
// bot filled every input it found, so we silently no-op instead of writing.
const honeypotInput = document.getElementById("website");
const statusEl = document.getElementById("status");
const submitButton = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "status";

  const message = messageInput.value.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    statusEl.textContent = `Feedback must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`;
    statusEl.className = "status status-error";
    return;
  }

  if (honeypotInput.value.trim() !== "") {
    // Pretend success — never tip off a bot that it was caught.
    form.reset();
    statusEl.textContent = "Thanks for the feedback!";
    statusEl.className = "status status-success";
    return;
  }

  const email = emailInput.value.trim();

  submitButton.disabled = true;
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, email: email || null }),
    });
    if (!res.ok) throw new Error(`feedback ${res.status}`);
    form.reset();
    statusEl.textContent = "Thanks for the feedback!";
    statusEl.className = "status status-success";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Something went wrong — please try again.";
    statusEl.className = "status status-error";
  } finally {
    submitButton.disabled = false;
  }
});
