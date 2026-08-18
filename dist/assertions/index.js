import { finalOutput, toolNames, } from "../dsh-adapter/index.js";
const list = (x) => Array.isArray(x) ? x.map(String) : typeof x === "string" ? [x] : [];
const contains = (text, want) => list(want).every((x) => text.includes(x));
export const evaluateCase = (c, events) => {
    const a = c.assert ?? c.assertions ?? {}, output = finalOutput(events), tools = toolNames(events), fail = (code, expected, actual) => ({
        code,
        expected,
        actual,
    });
    const failures = [];
    const end = events.findLast((e) => e.type === "turn/end");
    const reason = end?.data?.reason?.kind ??
        end?.status;
    if (a.turn_end !== undefined && String(reason) !== String(a.turn_end))
        failures.push(fail("turn_end", a.turn_end, reason));
    const called = list(a.tools_called ?? a.called_tools);
    let cursor = 0;
    for (const name of called) {
        cursor = tools.indexOf(name, cursor);
        if (cursor < 0) {
            failures.push(fail("tools_called", called, tools));
            break;
        }
        cursor++;
    }
    if (a.tools_exact !== undefined &&
        JSON.stringify(tools) !== JSON.stringify(list(a.tools_exact)))
        failures.push(fail("tools_exact", a.tools_exact, tools));
    const forbidden = list(a.tools_not_called ?? a.forbidden_tools);
    if (forbidden.some((x) => tools.includes(x)))
        failures.push(fail("tools_not_called", forbidden, tools));
    if (a.output_contains !== undefined && !contains(output, a.output_contains))
        failures.push(fail("output_contains", a.output_contains, output));
    if (a.output_not_contains !== undefined &&
        list(a.output_not_contains).some((x) => output.includes(x)))
        failures.push(fail("output_not_contains", a.output_not_contains, output));
    if (a.output_matches ?? a.output_regex) {
        try {
            if (!list(a.output_matches ?? a.output_regex).every((pattern) => new RegExp(pattern).test(output)))
                failures.push(fail("output_matches", a.output_matches ?? a.output_regex, output));
        }
        catch {
            failures.push(fail("invalid_regex", a.output_matches ?? a.output_regex, "invalid"));
        }
    }
    const d = events.map((e) => e.data ?? e);
    const encoded = (type) => d
        .filter((e, index) => events[index]?.type === type)
        .map((e) => JSON.stringify(e));
    if (a.tool_args_contains !== undefined &&
        !list(a.tool_args_contains).every((needle) => encoded("tool/call").some((value) => value.includes(needle))))
        failures.push(fail("tool_args_contains", a.tool_args_contains, encoded("tool/call")));
    if (a.tool_result_contains !== undefined &&
        !list(a.tool_result_contains).every((needle) => encoded("tool/result").some((value) => value.includes(needle))))
        failures.push(fail("tool_result_contains", a.tool_result_contains, encoded("tool/result")));
    if (a.max_steps !== undefined &&
        events.filter((e) => e.type === "step/end").length > Number(a.max_steps))
        failures.push(fail("max_steps", a.max_steps, events.length));
    if (a.max_tokens !== undefined) {
        const tokens = d.reduce((n, e) => n +
            Number(e.usage?.input ?? 0) +
            Number(e.usage?.output ?? 0), 0);
        if (tokens > Number(a.max_tokens))
            failures.push(fail("max_tokens", a.max_tokens, tokens));
    }
    if (a.no_tool_errors === true && events.some((e) => e.type === "tool/error"))
        failures.push(fail("no_tool_errors", true, false));
    return { ok: !failures.length, failures };
};
export const evaluateCaseWithJudge = async (c, events, judge) => {
    const structural = evaluateCase(c, events);
    const rubric = (c.assert ?? c.assertions ?? {}).output_judge;
    if (!structural.ok || rubric === undefined)
        return structural;
    if (!judge)
        return {
            ok: false,
            failures: [
                {
                    code: "output_judge_unavailable",
                    expected: rubric,
                    actual: "no judge",
                },
            ],
        };
    const ok = await judge({
        prompt: c.prompt,
        output: finalOutput(events),
        rubric,
    });
    return ok
        ? structural
        : {
            ok: false,
            failures: [
                { code: "output_judge", expected: rubric, actual: "rejected" },
            ],
        };
};
export const assertCase = (c, events) => evaluateCase(c, events).ok;
