import React, { useState } from "react";
import "./cookieBanner.scss";

const CookieBanner = () => {
  const cookiesConsent = localStorage.getItem("cookiesConsent");
  const [consent, setConset] = useState(cookiesConsent);

  const handleConsent = () => {
    localStorage.setItem("cookiesConsent", "accepted");
    setConset("accepted");
    // TO DO: Bind consent to user profile...
  };

  return (
    <div className={`cookie ${consent}`}>
      <p className="heading">Cookies Consent</p>
      <p className="content">
        We use essential cookies to ensure the proper functioning of our
        website. These cookies are necessary for the website to function and
        cannot be switched off in our systems. They are usually only set in
        response to actions made by you, such as logging in, or filling in
        forms. You can set your browser to block or alert you about these
        cookies, but some parts of the site may not work properly.
      </p>
      <p className="content">Thank you for your understanding.</p>
      <button className="accept" onClick={handleConsent}>
        Accept
      </button>
    </div>
  );
};

export default CookieBanner;
