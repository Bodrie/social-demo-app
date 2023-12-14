import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useQuery } from "@tanstack/react-query";
import { getActivities } from "../../services/axios";
import imgSrc from "../../assets/images.png";
import { ActivityType, User } from "../../types";
import moment from "moment";
import "./rightBar.scss";
import { socket } from "../../socket";

const RightBar = () => {
  const authCtx = useContext(AuthContext);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const { isLoading, error, data } = useQuery<ActivityType[]>({
    queryKey: ["activities"],
    queryFn: () => getActivities(authCtx?.user?.id!),
  });

  useEffect(() => {
    socket.on("get_online_users", (data: User[]) => {
      setOnlineUsers(data);
    });
    return () => {
      socket.off("get_online_users");
    };
  }, [socket]);

  if (isLoading || !data || !onlineUsers) return <p>Loading...</p>;  

  return (
    <div className="right-bar">
      <div className="container">
        <div className="item">
          <span>Suggestions for you</span>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="Recommended user" />
              <span>User Name</span>
            </div>
            <div className="buttons">
              <button>Follow</button>
              <button>Dismiss</button>
            </div>
          </div>
          <div className="user">
            <div className="user-info">
              <img src={imgSrc} alt="Recommended user" />
              <span>User Name</span>
            </div>
            <div className="buttons">
              <button>Follow</button>
              <button>Dismiss</button>
            </div>
          </div>
        </div>
        <div className="item">
          <span>Latest activities</span>
          {data.map(
            (
              { profilePic, user, activity, createdAt }: ActivityType,
              idx: number
            ) => {
              if (idx > 3) return;
              return (
                <div className="user">
                  <div className="user-info">
                    <img src={profilePic} alt="User activity on something" />
                    <span>{user}</span>
                    <p>{activity}</p>
                  </div>
                  <span className="when">{moment(createdAt).fromNow()}</span>
                </div>
              );
            }
          )}
        </div>
        <div className="item">
          <span>Online users</span>
          {onlineUsers.map(({ id, profile_picture, name }: User) => {
            return (
              <div className="user" key={id}>
                <div className="user-info">
                  <img src={profile_picture} alt="Online user" />
                  <span>{name}</span>
                  <div className="online" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RightBar;
