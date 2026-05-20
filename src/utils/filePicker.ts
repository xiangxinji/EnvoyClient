export function pickFiles(options?: { accept?: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (options?.accept) input.accept = options.accept;
    if (options?.multiple) input.multiple = true;
    input.onchange = () => {
      resolve(Array.from(input.files ?? []));
    };
    input.oncancel = () => {
      resolve([]);
    };
    input.click();
  });
}
