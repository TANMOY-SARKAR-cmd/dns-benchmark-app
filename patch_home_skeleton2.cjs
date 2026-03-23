const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf8');

// I replaced `<div className="space-y-6">` with `{isFetchingData ? <Skeleton ...> : <div className="space-y-6">`
// I need to find the end of that block.
code = code.replace(
  /                          <\/tbody>\n                        <\/table>\n                      <\/div>\n                    <\/div>\n                  <\/div>\n                \)}\n              <\/CardContent>/,
  `                          </tbody>\n                        </table>\n                      </div>\n                    </div>\n                  </div>\n                  )}\n                )}\n              </CardContent>`
);

fs.writeFileSync('frontend/src/pages/Home.tsx', code);
