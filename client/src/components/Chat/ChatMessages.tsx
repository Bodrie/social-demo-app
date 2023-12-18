import React from "react";
import { UserChat } from "../../types";
import { socket } from "../../socket";

interface ChatMessagesProps {
  chat: UserChat;
}

const ChatMessages = ({ chat }: ChatMessagesProps) => {
  return (
    <>
      {chat.messages && chat.messages.map(({ content, from }, idx) => {
        const msgClassName = socket.id !== from ? "msg in" : "msg";
        return (
          <div className={msgClassName} key={`${from}-${idx}`}>
            {content}
          </div>
        );
      })}
    </>
  );
};

export default ChatMessages;
