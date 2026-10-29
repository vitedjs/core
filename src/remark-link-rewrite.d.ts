declare module 'remark-link-rewrite' {
  interface Options {
    replacer?: (url: string) => string | Promise<string>;
  }

  interface Node {
    type: string;
    children?: Node[];
    url?: string;
    value?: string;
  }

  const remarkLinkRewrite: (options?: Options) => (tree: Node) => Node | Promise<Node>;

  export default remarkLinkRewrite;
}
