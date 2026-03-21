import re

with open('frontend/src/pages/Home.tsx', 'r') as f:
    content = f.read()

# Update Benchmark Results table Method badges (lines ~948-956)
old_method_badge = '''                                          <div
                                            className={`text-[10px] mt-1 inline-flex px-1.5 py-0.5 rounded font-mono font-medium ${result.fallbackUsed ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400" : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400"}`}
                                          >
                                            {result.method}
                                            {result.fallbackUsed
                                              ? " (fallback)"
                                              : ""}
                                          </div>'''

new_method_badge = '''                                          <div
                                            className={`text-[10px] mt-1 inline-flex px-1.5 py-0.5 rounded font-mono font-medium ${result.method === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : result.method === "client" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}`}
                                          >
                                            {result.method}
                                            {result.fallbackUsed
                                              ? " (fallback)"
                                              : ""}
                                          </div>'''

content = content.replace(old_method_badge, new_method_badge)

# Update History Table Method badges
old_history_table = '''                              <th className="py-3 px-4 font-semibold">
                                Latency
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Action
                              </th>'''

new_history_table = '''                              <th className="py-3 px-4 font-semibold">
                                Latency
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Method
                              </th>
                              <th className="py-3 px-4 font-semibold">
                                Action
                              </th>'''

content = content.replace(old_history_table, new_history_table)

old_history_row = '''                                <td className="py-3 px-4">
                                  {record.latency_ms}ms
                                </td>
                                <td className="py-3 px-4">
                                  {record.keep ? ('''

new_history_row = '''                                <td className="py-3 px-4">
                                  {record.latency_ms}ms
                                </td>
                                <td className="py-3 px-4">
                                  {record.method_used ? (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${record.method_used === "server" ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400" : record.method_used === "client" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400" : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400"}`}>
                                      {record.method_used}
                                      {record.fallback_used ? " (fallback)" : ""}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {record.keep ? ('''

content = content.replace(old_history_row, new_history_row)

with open('frontend/src/pages/Home.tsx', 'w') as f:
    f.write(content)
