import React from "react";
import Spline from '@splinetool/react-spline';
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function Animation() {
    return (
        <div
            style={{
                width: "fit-content",
                height: "100%",
                display: "grid",
                gridTemplateColumns: "1fr",
                gridTemplateRows: "1fr",
            }}
        >
            <div
                style={{
                    position: "relative",
                    minHeight: "0",
                    flex: 1,
                    width: "100%",
                    aspectRatio: "1 / 1",
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "center",
                    gridArea: "1 / 1 / 2 / 2",
                    zIndex: 0,
                }}
            >
                <img
                    src="/animation/hand.png"
                    alt="Hand Animation"
                    style={{
                        position: "relative",
                        width: "80%",
                        objectFit: "contain",
                        pointerEvents: "none",
                    }}
                />
            </div>

            <div
                style={{
                    height: "100%",
                    width: "100%",
                    gridArea: "1 / 1 / 2 / 2",
                    zIndex: 999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                }}
            >

                <h1
                    style={{
                        width: "fit-content",
                        fontSize: "var(--text-xl)",
                    }}
                >
                    Our Model is Generating its Results, Please Wait...
                </h1>
                <div

                    style={{
                        width: "60%",
                        height: "50%",
                        aspectRatio: "1 / 1",
                        overflow: "hidden",
                        marginRight:"auto",
                    }}
                >
                    <Spline scene="https://prod.spline.design/0uDj7etQW1FyFf4L/scene.splinecode"
                        style={{
                            height: "120%",
                        }}
                    />
                </div>

            </div>
        </div>
    );
}