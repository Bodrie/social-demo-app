import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header, LeftBar, RightBar, Chat } from "../../components";
import { UserChat, Messages } from "../../types";
import { socket } from "../../socket";
import "./main.scss";

const Main = () => {
  const [openChats, setOpenChats] = useState<UserChat<Messages>[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserChat<Messages>[]>([]);

  useEffect(() => {
    socket.on("online_users", (online: UserChat<Messages>[]) => {
      setOnlineUsers(online);
    });

    return () => {
      socket.off("online_users");
    };
  }, [socket]);

  useEffect(() => {
    socket.on("private_message", ({ content, from }: Messages) => {
      const chatToBeOpen = onlineUsers.find((user) => user.socketId === from);

      if (chatToBeOpen) {
        const chatIsAlreadyOpen = openChats.find(
          (chat) => chat.socketId === from
        );
        if (chatIsAlreadyOpen) {
          return setOpenChats((prevState) => {
            return prevState.map((chat) => {
              if (chat.socketId === from) {
                return {
                  ...chat,
                  messages: [...chat.messages, { content, from }],
                };
              }

              return chat;
            });
          });
        }
        return setOpenChats((prevState) => [
          ...prevState,
          {
            ...chatToBeOpen,
            messages: [{ content, from }],
          },
        ]);
      }
    });

    return () => {
      socket.off("private_message");
    };
  }, [socket, onlineUsers, openChats]);

  return (
    <>
      <Header />
      <div className="main">
        <LeftBar />
        <div className="outlet">
          <Outlet />
        </div>
        <RightBar onlineUsers={onlineUsers} setOpenChats={setOpenChats} />
        <Chat openChats={openChats} setOpenChats={setOpenChats} />
      </div>
    </>
  );
};

export default Main;
