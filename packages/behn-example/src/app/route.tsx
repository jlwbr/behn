import type { Page } from "behn";
import { db } from "../db/client";
import { items } from "../db/schema";
import { eq } from "drizzle-orm";
import { TodoList } from "../components/todo-list";

export const metadata = {
  title: "TODO",
};

export const get: Page = async () => {
  const safeTodoList = await TodoList();

  return (
    <div>
      <ul id="items">{safeTodoList}</ul>
      <form
        class="w-screen p-2 flex items-center justify-center gap-2"
        hx-post="/"
        hx-target="#items"
        {...{ "hx-on::after-request": "this.reset()" }}
      >
        <input name="name" type="text" class="flex-1 w-full border-2" />
        <button class="border-2" type="submit">
          +
        </button>
      </form>
    </div>
  );
};

export const DELETE: Page = async ({ request }) => {
  const id = request.headers.get("hx-trigger-name");
  if (id) await db.delete(items).where(eq(items.id, parseInt(id)));

  return await TodoList();
};

export const POST: Page = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get("name");
  await db.insert(items).values({
    name: name?.toString(),
  });

  const safeTodoList = await TodoList();

  return (
    <>
      {safeTodoList}
    </>
  );
};
