import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActivities,
  getUserSuggestions,
  addRelationship,
} from "../../services/axios";
import { ActivityType, UserChat, Messages } from "../../types";
import moment from "moment";
import "./rightBar.scss";

interface RightBarProps {
  onlineUsers: UserChat<Messages>[];
  setOpenChats: (rooms: React.SetStateAction<UserChat<Messages>[]>) => void;
}

const RightBar = ({ onlineUsers, setOpenChats }: RightBarProps) => {
  const queryClient = useQueryClient();
  const authCtx = useContext(AuthContext);

  const { isLoading, error, data } = useQuery<ActivityType[]>({
    queryKey: ["activities"],
    queryFn: () => getActivities(authCtx?.user?.id!),
  });

  const { isLoading: suggestionsLoading, data: suggestions } = useQuery<
    Record<string, string>[]
  >({
    queryKey: ["suggestions"],
    queryFn: () => getUserSuggestions(),
  });

  const joinUserChat = (newChat: UserChat<Messages>) => {
    setOpenChats((prev) => {
      if (prev.length === 0 || !new Set(prev).has(newChat))
        return [newChat, ...prev];

      return prev;
    });
  };

  const mutation = useMutation({
    mutationFn: (userId: string) => {
      return addRelationship({
        currUserId: authCtx.user.id,
        foreignUserId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relationships"] });
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });
  const handleFollow = (userId: string) => {
    mutation.mutate(userId);
  };

  if (isLoading || !data || !onlineUsers || suggestionsLoading || !suggestions)
    return <p>Loading...</p>;

  return (
    <div className="right-bar">
      <div className="container">
        <div className="item">
          <span>
            {suggestions.length
              ? "Suggestions for you"
              : "No current sugestions"}
          </span>
          <div className="suggestions">
            {suggestions.map((user) => {
              return (
                <div className="user" key={user.id}>
                  <Link className="user-info" to={`/profile?id=${user.id}`}>
                    <img src={user.profile_picture} alt="Recommended user" />
                    <span>{user.name}</span>
                  </Link>
                  <div className="buttons">
                    <button onClick={() => handleFollow(user.id)}>
                      Follow
                    </button>
                  </div>
                </div>
              );
            })}
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
          <span>{onlineUsers.length ? "Online users" : "Nobody's online"}</span>
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
