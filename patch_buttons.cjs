const fs = require('fs');
const file = 'frontend/src/pages/Home.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = `<Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleDeleteMonitor(monitor.id)
                                  }
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>`;

const replaceStr = `<div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleMonitor(monitor)}
                                    className={monitor.is_active ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" : "text-green-500 hover:text-green-600 hover:bg-green-500/10"}
                                    title={monitor.is_active ? "Stop Monitor" : "Start Monitor"}
                                  >
                                    {monitor.is_active ? <Square className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleDeleteMonitor(monitor.id)
                                    }
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>`;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(file, content);
    console.log("Replaced buttons successfully.");
} else {
    console.log("Could not find the search string.");
}
