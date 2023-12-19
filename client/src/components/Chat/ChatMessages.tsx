import React, { useEffect, useRef } from "react";
import { Messages, UserChat } from "../../types";
import { socket } from "../../socket";

interface ChatMessagesProps {
  chat: UserChat<Messages>;
}

const ChatMessages = ({ chat }: ChatMessagesProps) => {
  const msgElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {    
    msgElRef.current?.scrollIntoView();
  }, [chat.messages.length]);  

  return (
    <>
      {chat.messages &&
        chat.messages.map(({ content, from }, idx) => {
          const msgClassName = socket.id !== from ? "msg in" : "msg";
          return (
            <div className={msgClassName} key={`${from}-${idx}`} ref={msgElRef}>
              {content}
            </div>
          );
        })}
    </>
  );
};

export default ChatMessages;
