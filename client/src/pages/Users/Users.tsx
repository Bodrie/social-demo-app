import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllUsers } from "../../services/axios";
import { User } from "../../types";
import "./users.scss";
import { Link } from "react-router-dom";

const Users = () => {
  const { isLoading, error, data } = useQuery<User[]>({
    queryKey: ["allUsers"],
    queryFn: getAllUsers,
  });

  if (isLoading || !data?.length) return <p>Loading...</p>;

  return (
    <div className="users">
      {data.map((user: User) => {
        return (
          <Link to={`/profile?id=${user?.id}`} className="user" key={user.id}>
            <img src={user?.profile_picture} />
            <div>{user?.name}</div>
            <div>({user?.username})</div>
            <div>{user?.city}</div>
          </Link>
        );
      })}
    </div>
  );
};

export default Users;
