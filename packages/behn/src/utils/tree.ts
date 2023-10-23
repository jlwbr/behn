import { boolean } from "valibot";

export class Node<T> {
  public parent?: Node<T>;
  public value: T;
  public children: Node<T>[];

  constructor(data: T) {
    this.value = data;
    this.children = [];
  }

  add(value: T) {
    const node = new Node(value);
    node.parent = this;
    this.children.push(node);

    return node;
  }

  remove(value: T) {
    this.children = this.children.filter((node) => {
      return node.value !== value;
    });
  }
}

export class Tree<T> {
  public root?: Node<T>;

  constructor(root?: T) {
    this.root = root ? new Node(root) : undefined;
  }

  update_or_add_at_location<Y>(
    value: T,
    pathspec: Y[],
    compare_function: (value: T, pathspec: Y) => boolean,
    target: (value: T) => boolean,
  ) {
    if (!this.root) {
      this.root = compare_function(value, pathspec[0])
        ? new Node(value)
        : undefined;

      return;
    }

    let current_node = this.root;
    pathspec.shift();

    for (const part of pathspec) {
      const child = current_node.children.find((node) =>
        compare_function(node.value, part),
      );

      if (!child) break;
      current_node = child;
    }

    if (target(current_node.value)) {
      current_node.value = value;
    } else {
      current_node.add(value);
    }
  }

  BFS(prune: (value: T) => boolean, target: (value: T) => boolean) {
    const arr = [this.root];
    while (arr.length) {
      const node = arr.shift();
      if (!node) return;

      if (target(node.value)) return node;
      if (!prune(node.value)) arr.push(...node.children);
    }
  }

  DFS(prune: (value: T) => boolean, target: (value: T) => boolean) {
    const arr = [this.root];
    while (arr.length) {
      const node = arr.shift();
      if (!node) return;

      if (target(node.value)) return node;
      if (!prune(node.value)) arr.unshift(...node.children);
    }
  }
}
