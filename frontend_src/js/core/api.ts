import { iter_sse } from "../util/sse.js";
import { ApprovalStateResolved } from "./log_view.js";


export async function endpoint_stream(user_message: string, session_id: string) {
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


export async function endpoint_resume(approvals: Record<string, ApprovalStateResolved>, session_id: string) {
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
