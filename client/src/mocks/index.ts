import imgSrc from "../assets/images.png";
import imgSrc2 from "../assets/story-placeholder.webp";
import { Story, Comment } from "../types";

export const comments: Comment[] = [
  {
    id: 1,
    content:
      "Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123 Lorem ipsum... 123, Lorem ipsum um... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123 Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123um... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123 Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123um... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123 Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123... 123, Lorem ipsum... 123, Lorem ipsum... 123, Lorem ipsum... 123",
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
