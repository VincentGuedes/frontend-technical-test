import { Box, Text, useDimensions } from "@chakra-ui/react";
import { useMemo, useRef } from "react";

export type MemePictureProps = {
  pictureUrl: string;
  texts: {
    content: string;
    x: number;
    y: number;
  }[];
  dataTestId?: string;
  onCaptionMove?: (index: number, x: number, y: number) => void;
};

const REF_WIDTH = 800;
const REF_HEIGHT = 450;
const REF_FONT_SIZE = 36;

export const MemePicture: React.FC<MemePictureProps> = ({
  pictureUrl,
  texts: rawTexts,
  onCaptionMove,
  dataTestId = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef, true);
  const boxWidth = dimensions?.borderBox.width;

  const { height, fontSize, texts } = useMemo(() => {
    if (!boxWidth) {
      return { height: 0, fontSize: 0, texts: rawTexts };
    }

    return {
      height: (boxWidth / REF_WIDTH) * REF_HEIGHT,
      fontSize: (boxWidth / REF_WIDTH) * REF_FONT_SIZE,
      texts: rawTexts.map((text) => ({
        ...text,
        x: (boxWidth / REF_WIDTH) * text.x,
        y: (boxWidth / REF_WIDTH) * text.y,
      })),
    };
  }, [boxWidth, rawTexts]);

  return (
    <Box
      width="full"
      height={height}
      ref={containerRef}
      backgroundImage={pictureUrl}
      backgroundColor="gray.100"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      backgroundSize="contain"
      overflow="hidden"
      position="relative"
      borderRadius={8}
      data-testid={dataTestId}
    >
      {texts.map((text, index) => (
        <Box
          key={index}
          position="absolute"
          left={text.x}
          top={text.y}
          cursor="move"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startY = e.clientY;

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const dx = moveEvent.clientX - startX;
              const dy = moveEvent.clientY - startY;

              const newX = text.x + dx;
              const newY = text.y + dy;

              if (typeof onCaptionMove === "function" && boxWidth) {
                const scaledX = (newX / boxWidth) * REF_WIDTH;
                const scaledY = (newY / boxWidth) * REF_WIDTH;
                onCaptionMove(index, scaledX, scaledY);
              }
            };

            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        >
          <Text
            fontSize={fontSize}
            color="white"
            fontFamily="Impact"
            fontWeight="bold"
            userSelect="none"
            textTransform="uppercase"
            style={{ WebkitTextStroke: "1px black" }}
            data-testid={`${dataTestId}-text-${index}`}
          >
            {text.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
