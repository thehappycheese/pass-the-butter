import { Queue } from "../util/queue.js";
import { h } from "../util/hyperscript.js";
import { function_format } from "../util/function_format.js";
import { type AsyncIterSSE } from "../util/sse.js";
import { Entry } from "../components/Entry.js";

/**
 * @deprecated use Entry instead.
 */
class MessageDom {
    host:HTMLDivElement;
    label:HTMLDivElement;
    body:HTMLDivElement;

    constructor(host:HTMLDivElement, label:HTMLDivElement, body:HTMLDivElement) {
        this.host = host;
        this.label = label;
        this.body = body;
    }
}

/** Pass in map of bools from tool_call_id to approved status to resume the stream */
export type ResumeFunc = (approvals:Record<string, ApprovalStateResolved>) => void

/** @deprecated use SSEEvent */
export type StreamMessage = {
    event:string
    data:any
}

export type ApprovalState = {
  tool_call_id:string;
  interrupt_id:string;
  approved:boolean|null;
}
export type ApprovalStateResolved = Omit<ApprovalState, "approved">& {
  approved:boolean;
}

export function approvals_all_resolved(approvals:Record<string, ApprovalState>): approvals is Record<string, ApprovalStateResolved>{
    return Object.values(approvals).every(i=>i.approved!==null);
}


export class LogView {

    resume:ResumeFunc;
    train_of_thunk:Queue<() => Promise<AsyncIterSSE>>;
    /** if the think() method is currently working this internal flag stops it from retriggering */
    thinking:boolean;
    message_log:Entry[];
    tool_calls:Record<string, Entry>;    
    approvals:null|Record<string, ApprovalState>;
    host:HTMLElement;


    constructor(host:HTMLElement, resume:ResumeFunc) {
        this.resume = resume;
        this.host = host;
        this.approvals = null;
        this.thinking = false;
        this.message_log = [];
        this.tool_calls = {};
        this.train_of_thunk = new Queue();
    }

    scroll_bottom() {
        this.host.scrollTop = this.host.scrollHeight;
    }

    add_tool_call(id:string, name:string, args:Record<string,any>):MessageDom {
        const dom = this.add_entry(
            "tool_call",
            "Tool Call",
            function_format(name, args)
        );
        this.tool_calls[id] = dom;
        return dom
    }

    add_tool_call_result(tool_call_id:string, message:string):MessageDom {
        const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
            tool_call_id,
            "unknown",
            {}
        )
        
        dom.body.appendChild(h("div",{class:"tool_call_result"},"Result: "+message))
        this.scroll_bottom();
        return dom
    }

    add_request_for_approval(tool_call_id:string) {
        const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
            tool_call_id,
            `unknown (Request for Approval looked for tool call id ${tool_call_id})`,
            {}
        )

        const on_approve = () => {
            approval_form.remove();
            this.set_approval_result(tool_call_id, true);
            dom.body.append(h("div",{class:"approval_form_user_approved"},
                "User Action: APPROVED TOOL CALL"));
        }
        const on_deny = () => {
            approval_form.remove();
            this.set_approval_result(tool_call_id, false);
            dom.body.append(h("div",{class:"approval_form_user_denied"},
                "User Action: DENIED TOOL CALL"));
        }

        const approval_form = h("div", {
            class:"approval_form",
        },[
            h("div",{},"Allow this tool to run:"),
            h("div",{
                style:{
                    display:"flex",
                    gap:"2em",
                }
            },[
                h("button",{class:"approve",on:{click:on_approve}},"YES"),
                h("button",{class:"deny",on:{click:on_deny}},"NO")
            ])
        ])

        dom.body.appendChild(approval_form);
        this.scroll_bottom();
        return dom;
    }

    set_approval_result(tool_call_id:string, result:boolean) {
        if (this.approvals === null || !(tool_call_id in this.approvals)) {
            throw new Error(`unexpected approval ${tool_call_id} ${result}`)
        }
        this.approvals[tool_call_id].approved = result;
        if (approvals_all_resolved(this.approvals)) {
            this.resume(this.approvals);
            this.clear_approvals()
            this.think()
        }
    }

    init_approval(tool_call_id:string, interrupt_id:string) {
        const a = this.approvals || {};
        this.approvals = a;
        a[tool_call_id] = {
            tool_call_id,
            interrupt_id,
            approved: null
        };
    }

    clear_approvals() {
        this.approvals = null;
    }

    /**
     * @deprecated use Entry
     */
    add_entry(cls:string, label:string, text:string) {

        const l = h("div", { class: "label" }, label);
        const b = h("div", { class: "body" }, text);
        const div = h("div", { class: ["entry", cls] }, [l,b]);

        this.host.appendChild(div);
        this.scroll_bottom();

        const msg_dom = new MessageDom(div, l, b);

        this.message_log.push(msg_dom);

        return msg_dom;
    }

    async handle_stream(
        events:AsyncIterSSE,
    ) {

        let assistant_body:MessageDom|null = null;

        for await (const { event, data } of events) {
            if (event === "token") {
                if (!assistant_body) {
                    assistant_body = this.add_entry("assistant", "assistant", "");
                }
                assistant_body.body.textContent += data.text;
                this.scroll_bottom();
            } else {
                assistant_body = null;  // next token starts a new bubble
                if (event === "tool_call") {
                    this.add_tool_call(
                        data.id,
                        data.name,
                        data.args,
                    );
                } else if (event === "tool_result") {
                    this.add_tool_call_result(data.id, data.content);
                } else if (event === "error") {
                    this.add_entry("error", "error", data.message);
                } else if (event === "done") {
                    this.add_entry("done", "done", "");
                } else if (event === "approval_required") {
                    const { tool, args, tool_call_id, interrupt_id } = data;
                    this.init_approval(tool_call_id, interrupt_id);
                    this.add_request_for_approval(
                        tool_call_id,
                    )
                } else {
                    this.add_entry("unknown", "event", JSON.stringify(data));
                }
            }
        }
    }

    async think() {
        if (this.thinking) {
            return
        }
        this.thinking = true;
        while (this.train_of_thunk.not_empty()) {
            const next = this.train_of_thunk.dequeue();
            if (!next) break;
            await this.handle_stream(
                await next(),
            );
        }
        this.thinking = false;
    }
}