import type { ChatMessage as Msg } from "./types";
import Attachment from "./Attachment";

export default function ChatMessage({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";

  return (
    <div className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[92%] sm:max-w-[80%] rounded-2xl border p-3",
          isUser ? "bg-foreground text-background" : "bg-background",
        ].join(" ")}
      >
        <div className="whitespace-pre-wrap text-sm">{msg.text}</div>

        {msg.attachments?.length ? (
          <div className="mt-3 grid gap-3">
            {msg.attachments.map((a) => (
              <Attachment key={a.id} item={a} />
            ))}
          </div>
        ) : null}

        <div className="mt-2 text-[11px] opacity-70">
          {new Date(msg.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
