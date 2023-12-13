import moment from "moment";

export const momentConfig = () => {
  return moment.updateLocale("en", {
    relativeTime: {
      future: "in %s",
      past: "%s",
      s: "now",
      ss: "%ds ago",
      m: "%dm ago",
      mm: "%dm ago",
      h: "%dh ago",
      hh: "%dh ago",
      d: "%dd ago",
      dd: "%dd ago",
      M: "%dmth ago",
      MM: "%dmth ago",
      y: "%dy ago",
      yy: "%dy ago",
    },
  });
};
