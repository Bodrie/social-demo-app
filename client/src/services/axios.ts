import axios, { AxiosResponse } from "axios";
import { Register, Login, PostCreate, CommentCreate, PostLike } from "../types";

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

export const getPosts = () => {
  const response = makeRequest
    .get("/posts")
    .then((res) => {
      console.log(' === FROM AXIOS RES === ');
      console.log(res);
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

export const likePost = (likeData: PostLike) => {
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

export const dislikePost = (dislikeData: PostLike) => {
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
