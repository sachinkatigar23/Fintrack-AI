import { useState } from "react";
import { Eye, EyeOff } from "../common/icons.js";

export default function PasswordInput({ id, value, onChange, placeholder, autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        id={id}
        className="input"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
      />
      <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}
