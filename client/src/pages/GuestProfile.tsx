import { useState } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import "./guest-profile.css";

const levelScale = [
  { value: "none", label: "None" },
  { value: "basic", label: "Basic" },
  { value: "simple", label: "Simple" },
  { value: "daily", label: "Daily" },
  { value: "fluent", label: "Fluent" },
];

export default function GuestProfile() {
  const [languageLevels, setLanguageLevels] = useState({
    jp: "simple",
    en: "daily",
  });

  const updateLevel = (key: "jp" | "en", value: string) => {
    setLanguageLevels((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <PageLayout mainClassName="guest-main">
      <header className="guest-header">
        <p className="guest-pill">Guest Web3 profile</p>
        <h1 className="guest-title">Guest Profile Setup</h1>
        <p className="guest-lead">
          NFTベースの滞在証明やウォレット評価と連動しながら、ホストに伝えたい情報を整理します。
        </p>
      </header>

      <div className="guest-card">
        <div className="card-title">Profile Photo</div>
        <div className="avatar-wrap">
          <div className="avatar-preview">Your Photo</div>
          <input type="file" accept="image/*" />
        </div>
      </div>

      <div className="guest-card">
        <div className="card-title">Basic Information</div>
        <div className="grid-2">
          <div>
            <label>First Name</label>
            <input type="text" placeholder="John" />
          </div>
          <div>
            <label>Last Name</label>
            <input type="text" placeholder="Smith" />
          </div>
          <div>
            <label>Nationality</label>
            <input type="text" placeholder="United States" />
          </div>
          <div>
            <label>Date of Birth</label>
            <input type="date" />
          </div>
          <div>
            <label>Sex</label>
            <select>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="guest-card">
        <div className="card-title">Emergency Contact</div>
        <div className="grid-2">
          <div>
            <label>Name</label>
            <input type="text" placeholder="Parent / Guardian" />
          </div>
          <div>
            <label>Relationship</label>
            <input type="text" placeholder="Mother" />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" placeholder="+1 000 0000 0000" />
          </div>
        </div>
      </div>

      <div className="guest-card">
        <div className="card-title">Language Skills</div>

        <div className="lang-skill">
          <div className="lang-label">
            Spoken Japanese <span className="lang-sub">日本語（会話）</span>
          </div>
          <div className="level-scale">
            {levelScale.map((level) => (
              <label key={level.value} className="level-item">
                <input
                  type="radio"
                  name="jp"
                  value={level.value}
                  checked={languageLevels.jp === level.value}
                  onChange={() => updateLevel("jp", level.value)}
                />
                <span>{level.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="lang-skill">
          <div className="lang-label">
            Spoken English <span className="lang-sub">英語（会話）</span>
          </div>
          <div className="level-scale">
            {levelScale.map((level) => (
              <label key={level.value} className="level-item">
                <input
                  type="radio"
                  name="en"
                  value={level.value}
                  checked={languageLevels.en === level.value}
                  onChange={() => updateLevel("en", level.value)}
                />
                <span>{level.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="guest-card">
        <div className="card-title">Message to Your Host</div>
        <textarea
          placeholder="Please write anything you would like your host to know in advance (lifestyle, expectations, concerns, etc.)"
        />
      </div>

      <button type="button" className="primary-btn guest-save-btn">
        Save Profile
      </button>
      <p className="guest-footnote">
        プロフィールはStay Oneチェーン上のソウルバウンドトークンとしてホストと共有されます。
      </p>
    </PageLayout>
  );
}
