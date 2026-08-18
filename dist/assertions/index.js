export const assertCase = (c, events) => { const output = String(events.findLast(e => e.type === 'assistant/final')?.text ?? ''); const tools = events.filter(e => e.type === 'tool/call').map(e => String(e.name)); const a = c.assertions ?? {}; const required = (a.called_tools ?? []); const forbidden = (a.forbidden_tools ?? []); if (required.some(x => !tools.includes(x)))
    return false; if (forbidden.some(x => tools.includes(x)))
    return false; if (typeof a.output_contains === 'string' && !output.includes(a.output_contains))
    return false; if (typeof a.output_not_contains === 'string' && output.includes(a.output_not_contains))
    return false; if (typeof a.output_regex === 'string' && !new RegExp(a.output_regex).test(output))
    return false; if (a.no_tool_errors === true && events.some(e => e.type === 'tool/error'))
    return false; return !events.some(e => e.type === 'turn/end' && e.status === 'error'); };
