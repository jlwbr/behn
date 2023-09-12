export class Node<T> {
  public data: T;
  public children: Node<T>[];

  constructor(data: T) {
    this.data = data;
    this.children = [];
  }

  add(data: T) {
    this.children.push(new Node(data));
  }

  remove(data: T) {
    this.children = this.children.filter((node) => {
      return node.data !== data;
    });
  }
}

export class Tree<T> {
  public root: Node<T>;

  constructor(root: Node<T>) {
    this.root = root;
  }

  BFS(cb: (node: Node<T>) => boolean) {
    const arr = [this.root];
    while (arr.length) {
      const node = arr.shift();
      if (!node) return;

      const prune = cb(node);

      if (!prune) arr.push(...node.children);
    }
  }

  DFS(cb: (node: Node<T>) => void) {
    const arr = [this.root];
    while (arr.length) {
      const node = arr.shift();
      if (!node) return;

      arr.unshift(...node.children);
      cb(node);
    }
  }
}
