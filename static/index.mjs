"use strict";
import { iter_sse } from "./core/sse.mjs";
import { LogView } from "./core/log_view.mjs";

const SESSION_ID = crypto.randomUUID();

/** @type {HTMLDivElement} */
const log = document.getElementById("log");
/** @type {HTMLFormElement} */
const form = document.getElementById("form");
/** @type {HTMLInputElement} */
const input = document.getElementById("input");
/** @type {HTMLButtonElement} */
const send = document.getElementById("send");

const logview = new LogView(log);

form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    send.disabled = true;

    logview.add_entry("user", "user", message);

    // The current assistant "bubble" — created lazily on first token,
    // reset whenever a non-token event arrives so the next token batch
    // starts a fresh entry. This keeps streamed text grouped per turn.

    logview.train_of_thunk.enqueue(async () => {
        const response = await fetch("/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                session_id: SESSION_ID
            }),
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return iter_sse(response)
    });

    try {
        await logview.think({
            resume: (approved) => {
                logview.train_of_thunk.enqueue(async () => {
                    const response = await fetch("/resume", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            session_id: SESSION_ID,
                            approved
                        }),
                    });
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    return iter_sse(response)
                })
            }
        });
    // } catch (err) {
    //     logview.add_entry("error", "error", String(err));
    } finally {
        send.disabled = false;
        input.focus();
    }
});

input.focus();