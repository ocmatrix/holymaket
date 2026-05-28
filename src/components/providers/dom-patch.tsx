"use client";
if (typeof window !== "undefined") {
    const origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
        if (child.parentNode !== this) {
            return child;
        }
        return origRemoveChild.call(this, child) as T;
    };
    const origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
        if (refNode && refNode.parentNode !== this) {
            return newNode;
        }
        return origInsertBefore.call(this, newNode, refNode) as T;
    };
}
export function DomPatch() {
    return null;
}
