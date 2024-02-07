import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllUsers } from "../../services/axios";
import { User } from "../../types";
import { LoadingSpinner } from "../../components";
import "./users.scss";

const Users = () => {
  const { isLoading, error, data } = useQuery<User[]>({
    queryKey: ["allUsers"],
    queryFn: getAllUsers,
  });

  const loading = isLoading || !data?.length;

  return (
    <div className="users">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {data.map((user: User) => {
            return (
              <Link
                to={`/profile?id=${user?.id}`}
                className="user"
                key={user.id}
              >
                <img src={user?.profile_picture} />
                <div>{user?.name}</div>
                <div>({user?.username})</div>
                <div>{user?.city}</div>
              </Link>
            );
          })}
        </>
      )}
    </div>
  );
};

export default Users;
