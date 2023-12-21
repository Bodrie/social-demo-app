import React, { useState } from "react";
import { Send, Close, Add } from "@mui/icons-material";
import { Messages, UserChat } from "../../types";
import { socket } from "../../socket";
import ChatMessages from "./ChatMessages";
import "./chat.scss";

interface ChatProps {
  openChats: UserChat<Messages>[];
  setOpenChats: (openChat: React.SetStateAction<UserChat<Messages>[]>) => void;
}

const Chat = ({ openChats, setOpenChats }: ChatProps) => {
  type InputValue = {
    key: string;
  };
  const [inputValue, setInputValue] = useState<InputValue>({ key: "" });
  const [file, setFile] = useState<File | null>(null);

  const sendMessage = (chat: UserChat<Messages>) => {
    socket.emit("private_message", {
      content: inputValue[chat.name as keyof InputValue],
      to: chat.socketId,
    });

    const existingChat = openChats.find(
      (openChat) => openChat.userId === chat.userId
    );

    if (existingChat) {
      const newMessage = {
        content: inputValue[chat.name as keyof InputValue],
        from: socket.id,
      };

      existingChat.messages
        ? existingChat.messages.push(newMessage)
        : (existingChat.messages = [newMessage]);
    } else {
      setOpenChats((prev) => [...prev, chat]);
    }

    setInputValue({ ...inputValue, [chat.name as keyof InputValue]: "" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue({
      ...inputValue,
      [e.target.name]: value,
    });
  };

  const closeChat = (userChat: UserChat<Messages>) => {
    socket.emit("chat_closed", userChat);
    const restChats = openChats.filter(
      (chat) => chat.userId !== userChat.userId
    );
    setOpenChats(restChats);
  };

  return (
    <div className="chats">
      {openChats.map((chat) => {
        return (
          <div className="chat" key={chat?.userId.toString()}>
            <div className="chat-container">
              <div className="user">
                <img src={chat?.profilePic} alt="Online user" />
                <span>{chat?.name}</span>
                <Close onClick={() => closeChat(chat)} />
              </div>
              <div className="msg-container">
                <ChatMessages chat={chat} />
              </div>
              <div className="send">
                <input
                  type="file"
                  id="file"
                  onChange={(e) =>
                    setFile(
                      e.currentTarget.files ? e.currentTarget.files[0] : null
                    )
                  }
                />
                <label htmlFor="file">
                  <Add />
                </label>
                <input
                  id={chat.userId.toString()}
                  name={chat.name}
                  type="text"
                  value={inputValue[chat.name as keyof InputValue] || ""}
                  onChange={(e) => handleInputChange(e)}
                  onKeyDownCapture={(e) =>
                    e.code === "Enter" &&
                    e.currentTarget.value.length &&
                    sendMessage(chat)
                  }
                />
                <Send
                  onClick={(e) =>
                    //@ts-ignore
                    e.currentTarget.previousSibling.value && sendMessage(chat)
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Chat;
