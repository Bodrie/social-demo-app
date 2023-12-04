import imgSrc from "../assets/images.png";
import imgSrc2 from "../assets/story-placeholder.webp";
import { Post, Story } from "../types";

export const posts: Post[] = [
  {
    id: 1,
    name: "Jane Doe",
    userId: 1,
    profilePic: imgSrc,
    content:
      "Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123",
  },
  {
    id: 2,
    name: "Doe Someone",
    userId: 32,
    profilePic: imgSrc,
    content:
      "ipsum. Lorem ipsuLoremLorem ipsum... 123, Lorem ipsum..., Lorem ipsum... 123, Lorem, Lorem ipsum... 123",
  },
];

export const stories: Story[] = [
  { id: 1, name: "asd", img: imgSrc2 },
  { id: 2, name: "222", img: imgSrc2 },
  { id: 3, name: "333", img: imgSrc2 },
];
