import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/authContext";
import { Outlet } from "react-router-dom";
import { Header, LeftBar, RightBar, Chat } from "../../components";
import { UserChat } from "../../types";
import { socket } from "../../socket";
import "./main.scss";

const Main = () => {
  const authCtx = useContext(AuthContext);
  const [openChats, setOpenChats] = useState<UserChat[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserChat[]>([]);

  useEffect(() => {
    socket.on("online_users", (data: UserChat[]) => {
      setOnlineUsers(data);
    });

    return () => {
      socket.off("online_users");
    };
  }, [socket]);

  useEffect(() => {
    socket.on(
      "private_message",
      ({ content, from }: { content: string; from: string }) => {
        const chatToBeOpen = onlineUsers.find((user) => user.socketId === from);

        if (chatToBeOpen) {
          const findChat = openChats.find((chat) => chat.socketId === from);

          if (findChat) {
            findChat.messages.push({ content, from });
            if (openChats.length > 1) {
              setOpenChats((prev) => [...prev, findChat]);
            } else {
              setOpenChats([findChat]);
            }
          } else {
            setOpenChats((prev) => [
              ...prev,
              {
                ...chatToBeOpen,
                messages: [{ content, from }],
              },
            ]);
          }
        }
      }
    );
    return () => {
      socket.off("private_message");
    };
  }, [onlineUsers, socket, openChats]);

  return (
    <>
      <Header />
      <div className="main">
        <LeftBar />
        <div className="outlet">
          <Outlet />
        </div>
        <RightBar onlineUsers={onlineUsers} setOpenChats={setOpenChats} />
        <Chat
          onlineUsers={onlineUsers}
          openChats={openChats}
          setOpenChats={setOpenChats}
        />
      </div>
    </>
  );
};

export default Main;
