import imgSrc from "../assets/images.png";
import imgSrc2 from "../assets/story-placeholder.webp";
import imgSrc3 from "../assets/placeholder1920x1000.png";
import { Post, Story, Comment } from "../types";

export const posts: Post[] = [
  {
    id: 1,
    name: "Jane Doe",
    userId: 1,
    profilePic: imgSrc,
    content:
      "Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123",
    contentImg: imgSrc3,
  },
  {
    id: 2,
    name: "Doe Someone",
    userId: 32,
    profilePic: imgSrc,
    content:
      "ipsum. Lorem ipsuLoremLorem ipsum... 123, Lorem ipsum..., Lorem ipsum... 123, Lorem, Lorem ipsum... 123",
    contentImg: imgSrc3,
  },
];

export const comments: Comment[] = [
  {
    id: 1,
    content:
      "Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123",
    name: "Jane Doe",
    userId: 1,
    profilePic: imgSrc,
  },
  {
    id: 2,
    content:
      "ipsum. Lorem ipsuLoremLorem ipsum... 123, Lorem ipsum..., Lorem ipsum... 123, Lorem, Lorem ipsum... 123",
    name: "Doe Someone",
    userId: 32,
    profilePic: imgSrc,
  },
];

export const stories: Story[] = [
  { id: 1, name: "asd", img: imgSrc2 },
  { id: 2, name: "222", img: imgSrc2 },
  { id: 3, name: "333", img: imgSrc2 },
];
