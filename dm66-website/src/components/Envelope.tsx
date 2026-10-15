import "./envelope.css";

type EnvelopeProps = { open?: boolean; compact?: boolean };

/** A little paper keepsake, drawn especially for the Digital Marketing 66D class. */
export function Envelope({ open = false, compact = false }: EnvelopeProps) {
  return (
    <div
      className={`envelope-stage${open ? " is-open" : ""}${compact ? " is-compact" : ""}`}
      aria-hidden="true"
    >
      <svg
        className="envelope-illustration"
        viewBox="0 0 540 510"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="dm66-envelope-back"
            x1="82"
            y1="192"
            x2="447"
            y2="456"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F8B5CB" />
            <stop offset="1" stopColor="#E994B3" />
          </linearGradient>
          <linearGradient
            id="dm66-envelope-front"
            x1="262"
            y1="282"
            x2="262"
            y2="452"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F8BDD1" />
            <stop offset="1" stopColor="#F1A9C3" />
          </linearGradient>
          <linearGradient
            id="dm66-letter"
            x1="134"
            y1="117"
            x2="381"
            y2="383"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFFCF6" />
            <stop offset="1" stopColor="#F8F0E7" />
          </linearGradient>
          <linearGradient
            id="dm66-wax"
            x1="244"
            y1="329"
            x2="282"
            y2="378"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#CB698F" />
            <stop offset=".5" stopColor="#AC416D" />
            <stop offset="1" stopColor="#8D3159" />
          </linearGradient>
          <linearGradient
            id="dm66-satin"
            x1="395"
            y1="86"
            x2="457"
            y2="172"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DB729B" />
            <stop offset=".26" stopColor="#FFCADD" />
            <stop offset=".48" stopColor="#E98BB0" />
            <stop offset=".73" stopColor="#F7B3CC" />
            <stop offset="1" stopColor="#C75E89" />
          </linearGradient>
          <linearGradient
            id="dm66-tulip"
            x1="428"
            y1="332"
            x2="465"
            y2="384"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F7B5CB" />
            <stop offset="1" stopColor="#D96F98" />
          </linearGradient>
          <filter id="dm66-shadow" x="-40%" y="-40%" width="180%" height="190%">
            <feDropShadow
              dx="0"
              dy="14"
              stdDeviation="14"
              floodColor="#A35277"
              floodOpacity=".13"
            />
          </filter>
          <filter
            id="dm66-paper-shadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="150%"
          >
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="5"
              floodColor="#9B5C76"
              floodOpacity=".14"
            />
          </filter>
          <filter id="dm66-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".67"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".055" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>

        <ellipse
          cx="273"
          cy="471"
          rx="185"
          ry="17"
          fill="#C980A3"
          opacity=".065"
        />
        <g
          className="envelope-sparkles"
          stroke="#CA799A"
          strokeWidth="1.3"
          strokeLinecap="round"
        >
          <path d="M81 107v14m-7-7h14M459 226v14m-7-7h14M440 48v10m-5-5h10" />
          <path d="m42 298 3-7 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM487 104l2-5 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <circle cx="112" cy="54" r="2" fill="#DCA1B8" stroke="none" />
          <circle cx="493" cy="276" r="2" fill="#DCA1B8" stroke="none" />
          <path
            d="M65 170c-11-12-21-1-9 9l9 7 8-11c8-13-5-19-8-5Z"
            fill="#E7A0BC"
            fillOpacity=".2"
            stroke="#D799B3"
          />
        </g>

        <g className="envelope-mail" filter="url(#dm66-shadow)">
          <path
            d="M73 241 247 118a24 24 0 0 1 28 0l174 123v197a13 13 0 0 1-13 13H86a13 13 0 0 1-13-13V241Z"
            fill="url(#dm66-envelope-back)"
            stroke="#E6A0BA"
          />
          <path d="m81 241 178-125 181 125" stroke="#FFDAE8" strokeWidth="2" />
          <g className="envelope-letter" filter="url(#dm66-paper-shadow)">
            <rect
              x="111"
              y="103"
              width="300"
              height="304"
              rx="3"
              transform="rotate(-6 261 255)"
              fill="url(#dm66-letter)"
              stroke="#EDDECE"
            />
            <g transform="rotate(-6 261 255)">
              <rect
                x="124"
                y="116"
                width="274"
                height="278"
                rx="1"
                stroke="#EAD5D0"
                strokeDasharray="2 4"
              />
              <path
                d="M242 135c3-9 13-5 10 2l-7 8-8-5c-7-4-3-14 5-5Z"
                fill="#D891AB"
              />
              <text
                x="261"
                y="184"
                className="envelope-date"
                textAnchor="middle"
                fill="#A94371"
              >
                20.10
              </text>
              <text
                x="261"
                y="205"
                className="envelope-letter-label"
                textAnchor="middle"
                fill="#BD8396"
              >
                MỘT NGÀY DÀNH RIÊNG CHO CẬU
              </text>
              <path d="M224 219h74" stroke="#DCA7B8" strokeWidth=".7" />
              <text
                x="145"
                y="252"
                className="envelope-greeting"
                fill="#A85474"
              >
                Gửi cậu,
              </text>
              <text x="145" y="278" className="envelope-message" fill="#AC8591">
                Mong cậu luôn rạng rỡ
              </text>
              <text x="145" y="300" className="envelope-message" fill="#AC8591">
                theo cách của riêng mình.
              </text>
              <path
                d="M146 320h180M146 333h147"
                stroke="#D6BABC"
                strokeWidth=".7"
                opacity=".65"
              />
              <text
                x="360"
                y="368"
                className="envelope-signature"
                textAnchor="end"
                fill="#A85474"
              >
                Thương, DM66D ♡
              </text>
            </g>
            <path
              d="m165 99 92-9 5 23-92 9Z"
              fill="#EBCFC7"
              fillOpacity=".65"
            />
            <path
              d="m169 102 3 16m8-17 3 16m8-17 3 16m8-17 3 16m8-17 3 16m8-17 3 16m8-17 3 16m8-17 3 16m8-17 3 16"
              stroke="#D3AEA6"
              strokeOpacity=".25"
            />
          </g>

          <path
            d="m73 241 188 117L73 445V241Z"
            fill="#F3ABC5"
            stroke="#E9A0BB"
            strokeWidth=".8"
          />
          <path
            d="M449 241 261 358l188 87V241Z"
            fill="#F5B3CC"
            stroke="#E8A0BC"
            strokeWidth=".8"
          />
          <path
            d="m74 445 174-116a24 24 0 0 1 26 0l174 116a12 12 0 0 1-12 7H86c-5 0-10-3-12-7Z"
            fill="url(#dm66-envelope-front)"
            stroke="#E69AB8"
          />
          <path
            d="m80 444 169-112a22 22 0 0 1 24 0l169 112"
            stroke="#FFD5E4"
            strokeWidth="1.4"
          />
          <path
            className="envelope-flap"
            d="m74 242 174 115a24 24 0 0 0 26 0l174-115"
            fill="#F9C0D4"
            stroke="#E9A5BF"
            strokeWidth="1"
          />
          <path d="M87 440h348" stroke="#E99FBC" opacity=".5" />

          <g className="envelope-seal" filter="url(#dm66-paper-shadow)">
            <path
              d="M260 329c5-3 9 1 13 0 5 0 6 5 10 7 5 2 3 8 6 12 3 5-2 8-2 13s-6 6-9 10c-3 4-8 1-13 4-4 2-8-2-12-2-6 0-6-5-10-8-4-3-2-8-4-12-2-4 2-8 3-12 2-5 7-4 10-8 2-3 5-3 8-4Z"
              fill="url(#dm66-wax)"
            />
            <circle
              cx="263"
              cy="352"
              r="17.5"
              stroke="#EBA2BD"
              strokeOpacity=".6"
              strokeWidth=".9"
            />
            <circle
              cx="263"
              cy="352"
              r="14"
              stroke="#7F2A50"
              strokeOpacity=".35"
              strokeWidth=".7"
            />
            <path
              d="M263 348c-8-9-16 2-8 8l8 6 8-6c8-6 0-17-8-8Z"
              fill="#E7A0B9"
              stroke="#F4B1C9"
              strokeWidth=".7"
            />
          </g>

          <g transform="rotate(-13 132 398)" opacity=".77">
            <circle
              cx="132"
              cy="398"
              r="28"
              stroke="#BA6F91"
              strokeWidth=".8"
            />
            <circle
              cx="132"
              cy="398"
              r="24"
              stroke="#BA6F91"
              strokeWidth=".5"
              strokeDasharray="1 2.5"
            />
            <text
              x="132"
              y="391"
              textAnchor="middle"
              className="envelope-stamp"
              fill="#A75C80"
            >
              MADE WITH
            </text>
            <text
              x="132"
              y="408"
              textAnchor="middle"
              className="envelope-stamp-love"
              fill="#A75C80"
            >
              love
            </text>
            <path
              d="m172 390 27 2m-27 4 27 2m-27 4 27 2"
              stroke="#BA6F91"
              strokeWidth=".6"
            />
          </g>
          <path
            d="M391 398c-1-5 6-8 9-2 2-6 10-3 8 3-1 5-10 11-10 11s-8-7-7-12Z"
            fill="#F9D0DE"
          />
          <rect
            x="74"
            y="242"
            width="375"
            height="208"
            rx="9"
            fill="transparent"
            filter="url(#dm66-grain)"
            opacity=".6"
          />
        </g>

        <g className="envelope-bow" filter="url(#dm66-paper-shadow)">
          <path
            d="M408 131c-17-7-38-27-37-39 0-7 12-7 24-1 16 7 25 23 24 34Z"
            fill="url(#dm66-satin)"
            stroke="#DB86A6"
            strokeWidth=".7"
          />
          <path
            d="M414 129c2-19 8-37 20-44 7-4 15 3 13 12-3 19-17 33-26 37Z"
            fill="url(#dm66-satin)"
            stroke="#DB86A6"
            strokeWidth=".7"
          />
          <path
            d="M373 92c13 3 29 17 38 35-17-6-30-16-38-35ZM443 89c-13 9-20 23-24 39 15-7 23-23 24-39Z"
            fill="#AF4975"
            fillOpacity=".24"
          />
          <path
            d="M410 132c-12 14-17 36-18 56l13-6 9 9c-1-20 4-36 7-54Z"
            fill="url(#dm66-satin)"
            stroke="#DB86A6"
            strokeWidth=".7"
          />
          <path
            d="M419 132c8 16 16 30 33 40l-1-14 12-3c-19-7-27-14-37-27Z"
            fill="url(#dm66-satin)"
            stroke="#DB86A6"
            strokeWidth=".7"
          />
          <path
            d="M417 137c-6 16-10 30-11 43M427 137c10 12 17 18 25 23"
            stroke="#FFDAE7"
            strokeOpacity=".7"
          />
          <path
            d="M410 123c5-3 12-1 16 3l-1 13c-7 1-12-1-16-5Z"
            fill="url(#dm66-satin)"
            stroke="#CF7399"
            strokeWidth=".7"
          />
        </g>

        <g className="envelope-tulips">
          <path
            d="M451 458c-7-45-15-81-26-118M453 459c6-40 11-62 20-91M454 458c-17-15-36-32-43-55"
            stroke="#789171"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M448 443c-24-10-39-28-41-50 21 9 32 28 41 50Z"
            fill="#90A589"
          />
          <path
            d="M452 449c3-26 12-47 29-59-1 27-11 44-29 59Z"
            fill="#9CAF92"
          />
          <path
            d="M445 421c-17-17-22-39-19-55 12 18 16 34 19 55Z"
            fill="#A6B99B"
          />
          <path
            d="m450 447-38-46m42 44 22-45"
            stroke="#6F876A"
            strokeWidth=".65"
            opacity=".6"
          />
          <g transform="rotate(-18 425 338)">
            <path
              d="M410 338c-4-12-2-25 4-34l12 9 12-9c8 17 4 37-10 42-7 3-15-1-18-8Z"
              fill="url(#dm66-tulip)"
              stroke="#D989A7"
              strokeWidth=".7"
            />
            <path
              d="M412 306c11 4 20 19 17 39-14 0-18-16-17-39Z"
              fill="#E98EAE"
            />
            <path
              d="M438 306c-15 4-23 20-16 39 12 3 19-17 16-39Z"
              fill="#F7BACD"
            />
            <path
              d="M426 313c-5 7-7 18-3 28"
              stroke="#FFD3DF"
              strokeWidth="1"
            />
          </g>
          <g transform="rotate(18 474 363)">
            <path
              d="M459 365c-5-12-2-25 3-31l12 8 12-7c7 16 2 34-10 39-8 2-14-2-17-9Z"
              fill="url(#dm66-tulip)"
              stroke="#D989A7"
              strokeWidth=".7"
            />
            <path
              d="M461 337c11 4 19 18 15 36-13 0-17-16-15-36Z"
              fill="#E58AAA"
            />
            <path
              d="M486 337c-16 3-21 21-15 36 12 3 18-15 15-36Z"
              fill="#F8BECE"
            />
            <path d="M474 343c-5 6-8 17-4 26" stroke="#FFDAE4" />
          </g>
          <path
            d="M436 450c7 1 21 0 28-4l-1 9c-9 4-17 3-25 3Z"
            fill="#EAC9BA"
            fillOpacity=".85"
          />
          <path
            d="m442 449 3 8m4-9 3 8m4-10 3 9"
            stroke="#D2A69B"
            strokeOpacity=".5"
          />
        </g>
      </svg>
    </div>
  );
}
