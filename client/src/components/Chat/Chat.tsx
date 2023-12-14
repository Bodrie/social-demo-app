import React, { useContext, useState } from "react";
import src from "../../assets/images.png";
import { Send, Close, Add } from "@mui/icons-material";
import "./chat.scss";
import { AuthContext } from "../../context/authContext";

const myArray = [
  { id: 8, text: "Hey, how's it going?" },
  { id: 35, text: "Not bad, just finished some work. You?" },
  {
    id: 8,
    text: "Same here, working on a project. Got any exciting plans for the weekend?",
  },
  { id: 35, text: "Thinking of catching a movie. Any recommendations?" },
  {
    id: 8,
    text: "I heard the new action film is good. Let's check it out together!",
  },
  { id: 35, text: "Sounds like a plan! What time works for you?" },
  { id: 8, text: "How about 7 PM? We can grab dinner before the movie." },
  { id: 35, text: "Perfect! Let's meet at our usual spot." },
  // Add more objects as needed
];

const Chat = () => {
  const [messagess, setMessagess] = useState(myArray);
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const authCtx = useContext(AuthContext);
  const currUser = authCtx.user.id;

  const handleSend = (e: React.MouseEvent) => {
    e.preventDefault();
    setMessagess((prev) => [...prev, { id: currUser, text: msg }]);
    setMsg("");
  };

  console.log(messagess);

  return (
    <div className="chats">
      <div className="chat">
        <div className="chat-container">
          <div className="user">
            <img src={src} alt="Online user" />
            <span>Curr name</span>
            <Close />
          </div>
          <div className="msg-container">
            {messagess
              // .slice(0)
              // .reverse()
              .map(({ id, text }, idx) => {
                const msgClassName = currUser === id ? "msg" : "msg in";
                return (
                  <div className={msgClassName} key={`${id}-${idx}`}>
                    {text}
                  </div>
                );
              })}
          </div>
          <div className="send">
            <input
              type="file"
              id="file"
              onChange={(e) =>
                setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)
              }
            />
            <label htmlFor="file">
              <Add />
            </label>

            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <Send onClick={handleSend} />
          </div>
        </div>
      </div>
      <div className="chat">
        <div className="chat-container">
          <div className="user">
            <img src={src} alt="Online user" />
            <span>Curr name</span>
            <Close />
          </div>
          <div className="msg-container">
            {messagess
              // .slice(0)
              // .reverse()
              .map(({ id, text }, idx) => {
                const msgClassName = currUser === id ? "msg" : "msg in";
                return (
                  <div className={msgClassName} key={`${id}-${idx}`}>
                    {text}
                  </div>
                );
              })}
          </div>
          <div className="send">
            <input
              type="file"
              id="file"
              onChange={(e) =>
                setFile(e.currentTarget.files ? e.currentTarget.files[0] : null)
              }
            />
            <label htmlFor="file">
              <Add />
            </label>

            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <Send onClick={handleSend} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
