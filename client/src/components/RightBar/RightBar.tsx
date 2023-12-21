import React, { useContext } from "react";
import { AuthContext } from "../../context/authContext";
import { useQuery } from "@tanstack/react-query";
import { getActivities } from "../../services/axios";
import imgSrc from "../../assets/images.png";
import { ActivityType, UserChat, Messages } from "../../types";
import moment from "moment";
import "./rightBar.scss";

interface RightBarProps {
  onlineUsers: UserChat<Messages>[];
  setOpenChats: (rooms: React.SetStateAction<UserChat<Messages>[]>) => void;
}

const RightBar = ({ onlineUsers, setOpenChats }: RightBarProps) => {
  const authCtx = useContext(AuthContext);
  const { isLoading, error, data } = useQuery<ActivityType[]>({
    queryKey: ["activities"],
    queryFn: () => getActivities(authCtx?.user?.id!),
  });

  const joinUserChat = (newChat: UserChat<Messages>) => {
    setOpenChats((prev) => {
      if (prev.length === 0 || !new Set(prev).has(newChat))
        return [...prev, newChat];

      return prev;
    });
  };

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
          {onlineUsers.map((user: UserChat<Messages>) => {
            if (authCtx?.user?.id === user.userId) return;
            return (
              <div
                className="user"
                key={user.userId}
                onClick={() => joinUserChat(user)}
              >
                <div className="user-info online">
                  <img src={user.profilePic} alt="Online user" />
                  <span>{user.name}</span>
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
