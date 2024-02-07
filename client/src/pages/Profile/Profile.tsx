import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getUserById,
  addRelationship,
  getRelationships,
  deleteRelationship,
} from "../../services/axios";
import { LoadingSpinner, Posts, UpdatePofile } from "../../components";
import { User } from "../../types";
import {
  FacebookTwoTone,
  Instagram,
  Twitter,
  LinkedIn,
  Pinterest,
  Place,
  Language,
  EmailOutlined,
  MoreVert,
} from "@mui/icons-material";
import "./profile.scss";

const Profile = () => {
  const queryClient = useQueryClient();
  const authCtx = useContext(AuthContext);
  const [queryParameters] = useSearchParams();
  const userId = queryParameters.get("id") as string;
  const [user, setUser] = useState<User>(null!);
  const [updateProfile, setUpdateProfile] = useState(false);

  const { isLoading, error, data } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => getUserById(userId),
  });

  const { data: relationshipData } = useQuery({
    queryKey: ["relationships"],
    queryFn: () => getRelationships(userId),
  });

  const mutation = useMutation({
    mutationFn: (isFollowing: boolean) => {
      return isFollowing
        ? deleteRelationship(userId)
        : addRelationship({
            currUserId: authCtx.user.id,
            foreignUserId: userId,
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relationships"] });
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });

  const handleAddRelationship = () => {
    mutation.mutate(relationshipData?.includes(authCtx.user.id));
  };

  useEffect(() => {
    if (data) {
      setUser(data[0]);
    }
  }, [data]);

  if (isLoading || !user) return <LoadingSpinner />;
  const isCurrentUser = user.id === authCtx.user.id;

  return (
    <div className="profile">
      {updateProfile ? (
        <UpdatePofile user={authCtx.user} setUpdateProfile={setUpdateProfile} />
      ) : (
        <>
          <div className="pictures">
            <img
              src={user.cover_picture}
              alt="Cover picture of user profile"
              className="cover"
            />
            <img
              src={user.profile_picture}
              alt="Main picture of user profile"
              className="main"
            />
          </div>
          <div className="profile-container">
            <div className="general-info">
              <div className="left">
                <a href="">
                  <FacebookTwoTone />
                </a>
                <a href="">
                  <Instagram />
                </a>
                <a href="">
                  <Twitter />
                </a>
                <a href="">
                  <LinkedIn />
                </a>
                <a href="">
                  <Pinterest />
                </a>
              </div>
              <div className="center">
                <span>{user.name}</span>
                <span>({user.username})</span>
                <div className="person-info">
                  <div className="item">
                    <Place />
                    <span>Bulgaria</span>
                  </div>
                  <div className="item">
                    <Language />
                    <span>Some Site Name</span>
                  </div>
                </div>
                {isCurrentUser ? (
                  <button onClick={() => setUpdateProfile(true)}>
                    Update profile
                  </button>
                ) : (
                  <button onClick={handleAddRelationship}>
                    {relationshipData?.includes(authCtx.user.id)
                      ? "Following"
                      : "Follow"}
                  </button>
                )}
              </div>
              <div className="right">
                {isCurrentUser ? <MoreVert /> : <EmailOutlined />}
              </div>
            </div>
            <Posts profileId={Number(userId)} />
          </div>
        </>
      )}
    </div>
  );
};

export default Profile;
