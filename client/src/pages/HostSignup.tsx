import { Link } from "wouter";
import { PageLayout } from "@/components/layout/SiteChrome";
import "./host-signup.css";

const formFields = [
  { label: "名前", type: "text", placeholder: "山田 太郎" },
  { label: "メールアドレス", type: "email", placeholder: "example@mail.com" },
  { label: "パスワード", type: "password", placeholder: "8文字以上" },
  { label: "パスワード（確認）", type: "password", placeholder: "もう一度入力してください" },
];

export default function HostSignup() {
  return (
    <PageLayout mainClassName="signup-main">
      <section className="signup-card">
        <div className="signup-headline">
          <p className="signup-pill">Web3 ホスト登録</p>
          <h1 className="signup-title">Stay One 新規会員登録</h1>
          <p className="signup-description">
            ウォレットで収益を受け取り、来日ゲストと直接つながるためのホストアカウントを開設します。
          </p>
        </div>

        <form className="signup-form">
          {formFields.map((field) => (
            <div key={field.label} className="signup-form-group">
              <label>{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} />
            </div>
          ))}

          <button type="button" className="primary-btn signup-btn">
            登録する
          </button>
          <p className="signup-note">
            署名（ダミー）によってWalletアドレスを紐付けます。既にメンバーの方は{" "}
            <Link href="/">こちらからログイン</Link>
          </p>
        </form>
      </section>
    </PageLayout>
  );
}
