import { function_format } from "../util/function_format";
import { h } from "../util/hyperscript";
import { Component } from "./Component";
import "./FunctionCall.css";

export class FunctionCall extends Component{
    tool_name:string;
    args:Record<string,any>;
    constructor(tool_name:string, args:Record<string, any>){
        super(h("div",{class:""},[
            function_format(tool_name,args)
        ]))
        this.tool_name = tool_name;
        this.args = args
    }
}