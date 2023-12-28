import axios, { AxiosResponse } from "axios";
import {
  Register,
  Login,
  PostCreate,
  CommentCreate,
  PostInteraction,
  ActivityType,
  RelationshipType,
  User,
} from "../types";

const API = process.env.REACT_APP_API;

const makeRequest = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const register = (
  e: React.MouseEvent<HTMLButtonElement>,
  registerData: Register
) => {
  e.preventDefault();

  const response = makeRequest
    .post("/auth/register", registerData)
    .then((res: AxiosResponse) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const login = (loginData: Login) => {
  const response = makeRequest
    .post("/auth/login", loginData)
    .then((res: AxiosResponse) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const logout = () => {
  const response = makeRequest
    .post("/auth/logout")
    .then((res) => {
      return res;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getAllUsers = () => {
  const response = makeRequest
    .get(`/users/all`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};


export const getUserById = (id: number | string) => {
  const response = makeRequest
    .get(`/users/${id}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const updateUser = (userData: User) => {
  const response = makeRequest
    .patch("/users", userData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getUserPosts = (id: number) => {
  const response = makeRequest
    .get(`/posts/user/${id}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getPosts = () => {
  const response = makeRequest
    .get("/posts")
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const addPost = (postData: PostCreate) => {
  const response = makeRequest
    .post("/posts", postData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getPostComments = (id: number) => {
  const response = makeRequest
    .get(`/comments/${id}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getPostCommentsCount = () => {
  const response = makeRequest
    .get("/comments/count")
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const addComment = (commentData: CommentCreate) => {
  const response = makeRequest
    .post("/comments", commentData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const likePost = (likeData: PostInteraction) => {
  const response = makeRequest
    .post("/likes/like", likeData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const dislikePost = (dislikeData: PostInteraction) => {
  const response = makeRequest
    .post("/likes/dislike", dislikeData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getActivities = (userId: number) => {
  const response = makeRequest
    .get(`/activities/${userId}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const addActivity = (activityData: ActivityType) => {
  const response = makeRequest
    .post("/activities", activityData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const getRelationships = (userId: string) => {
  const response = makeRequest
    .get(`/relationships/${userId}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const addRelationship = (relationshipData: RelationshipType) => {
  const response = makeRequest
    .post("/relationships", relationshipData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const deleteRelationship = (id: string) => {
  const response = makeRequest
    .delete(`/relationships?id=${id}`)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};

export const upload = (file: any) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = makeRequest
    .post("/upload", formData)
    .then((res) => {
      return res.data;
    })
    .catch((e) => {
      throw Error(e);
    });

  return response;
};
