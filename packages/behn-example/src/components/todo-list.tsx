import { db } from "../db/client";
import { items } from "../db/schema";
import { Delete } from "./delete-button";

export const TodoList = async () => {
  const safeTodoItems = await db.select().from(items);

  return (
    <>
      {safeTodoItems.map(({ id, name }) => (
        <li class="flex w-full justify-between py-1 px-2">
          {Html.escapeHtml(name)}
          <Delete id={id.toString()} />
        </li>
      ))}
    </>
  );
};
