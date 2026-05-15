import { iter_sse } from "./sse.mjs";

/**
 * @param {string} user_message 
 * @param {string} session_id 
 */
export async function endpoint_stream (user_message, session_id){
    const response = await fetch("/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_message,
            session_id,
        }),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return iter_sse(response);
}

/**
 * @param {Record<string, import("./log_view.mjs").ApprovalStateResolved>} approvals
 * @param {string} session_id
 */
export async function endpoint_resume(approvals, session_id){
    const response = await fetch("/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            approvals,
            session_id,
        }),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return iter_sse(response)
}
