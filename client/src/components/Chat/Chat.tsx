import React, { useContext, useEffect, useState } from "react";
import { Send, Close, Add } from "@mui/icons-material";
import { AuthContext } from "../../context/authContext";
import { UserChat } from "../../types";
import { socket } from "../../socket";
import "./chat.scss";

interface ChatProps {
  onlineUsers: UserChat[];
  openChats: UserChat[];
  setOpenChats: (openChat: React.SetStateAction<UserChat[]>) => void;
}

const Chat = ({ onlineUsers, openChats, setOpenChats }: ChatProps) => {
  const [inputValue, setInputValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const authCtx = useContext(AuthContext);

  const sendMessage = (chat: UserChat) => {
    socket.emit("private_message", {
      content: inputValue,
      to: chat.socketId,
    });

    if (chat.messages) {
      chat.messages.push({ content: inputValue, from: socket.id });
    } else {
      chat.messages = [{ content: inputValue, from: socket.id }];
    }

    if (openChats.length > 1) {
      setOpenChats((prev) => [...prev, chat]);
    } else {
      setOpenChats([chat]);
    }

    setInputValue("");
  };

  const closeChat = (userChat: UserChat) => {
    const restChats = openChats.filter(
      (chat) => chat.userId !== userChat.userId
    );
    setOpenChats(restChats);
  };

  return (
    <div className="chats">
      {openChats.map((chat) => {
        return (
          <div className="chat" key={chat?.userId}>
            <div className="chat-container">
              <div className="user">
                <img src={chat?.profilePic} alt="Online user" />
                <span>{chat?.name}</span>
                <Close onClick={() => closeChat(chat)} />
              </div>
              <div className="msg-container">
                {chat.messages?.map(({ content, from }, idx) => {
                  const msgClassName = socket.id !== from ? "msg in" : "msg";
                  console.log(socket.id , from);
                  
                  return (
                    <div className={msgClassName} key={`${from}-${idx}`}>
                      {content}
                    </div>
                  );
                })}
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
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <Send onClick={() => sendMessage(chat)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Chat;
