export const Delete = ({ id }: { id: string }) => (
  <button class="border-2 px-1" name={id} hx-delete="/" hx-target="#items">
    Delete
  </button>
);
