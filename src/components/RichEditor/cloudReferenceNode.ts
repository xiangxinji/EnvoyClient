import { Node, mergeAttributes } from "@tiptap/core";

export interface CloudRefAttrs {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
}

export const CloudReference = Node.create({
  name: "cloudReference",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: { default: "" },
      path: { default: "" },
      type: { default: "file" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-cloud-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const icon = HTMLAttributes["data-type"] === "directory" ? "📁" : "📄";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-cloud-ref": "",
        class: "cloud-ref-chip",
      }),
      `${icon} ${HTMLAttributes.name}`,
    ];
  },
});
