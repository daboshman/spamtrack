import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function Login() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: "asherdiba@gmail.com" });
    await signInWithPopup(auth, provider);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F9FAFB", fontFamily:"'Heebo', sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:40, textAlign:"center", border:"1px solid #E5E7EB", maxWidth:360 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚖️</div>
        <div style={{ fontSize:22, fontWeight:800, color:"#7C3AED", marginBottom:4 }}>SpamTrack</div>
        <div style={{ fontSize:13, color:"#9CA3AF", marginBottom:24 }}>מערכת ניהול תביעות ספאם</div>
        <button onClick={handleLogin} style={{ width:"100%", padding:"12px 0", background:"#7C3AED", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:15, cursor:"pointer" }}>
          התחבר עם Google
        </button>
      </div>
    </div>
  );
}
