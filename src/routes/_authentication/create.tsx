import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Textarea,
  VStack,
  useToast
} from "@chakra-ui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MemeEditor } from "../../components/meme-editor";
import { useMemo, useState } from "react";
import { MemePictureProps } from "../../components/meme-picture";
import { Plus, Trash } from "@phosphor-icons/react";
import { createMeme } from "../../api";
import { useAuthToken } from "../../contexts/authentication";

export const Route = createFileRoute("/_authentication/create")({
  component: CreateMemePage,
});

type Picture = {
  url: string;
  file: File;
};

function CreateMemePage() {
  const token = useAuthToken();
  const [picture, setPicture] = useState<Picture | null>(null);
  const [texts, setTexts] = useState<MemePictureProps["texts"]>([]);
  const [description, setDescription] = useState("");
  const toast = useToast();
  const navigate = useNavigate();

  const handleDrop = (file: File) => {
    setPicture({
      url: URL.createObjectURL(file),
      file,
    });
  };

  const handleAddCaptionButtonClick = () => {
    setTexts([
      ...texts,
      {
        content: `New caption ${texts.length + 1}`,
        x: Math.random() * 400,
        y: Math.random() * 225,
      },
    ]);
  };

  const handleDeleteCaptionButtonClick = (index: number) => {
    setTexts(texts.filter((_, i) => i !== index));
  };

  const handleCaptionContentChange = (index: number, content: string) => {
    const newTexts = [...texts];
    newTexts[index] = {
      ...newTexts[index],
      content,
    };
    setTexts(newTexts);
  };

  const handleCaptionMove = (index: number, x: number, y: number) => {
    const newTexts = [...texts];
    newTexts[index] = {
      ...newTexts[index],
      x,
      y,
    };
    setTexts(newTexts);
  };

  const memePicture = useMemo(() => {
    if (!picture) {
      return undefined;
    }

    return {
      pictureUrl: picture.url,
      texts,
      onCaptionMove: handleCaptionMove,
    };
  }, [picture, texts]);

  const handleSubmit = async () => {
    if (!picture || !token) return;

    try {
      // Round the values to integers before sending to API
      const integerTexts = texts.map(text => ({
        ...text,
        x: Math.floor(text.x),
        y: Math.floor(text.y)
      }));

      await createMeme(token, picture.file, description, integerTexts);

      toast({
        title: "Meme created!",
        description: "Your meme has been posted successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });

      navigate({ to: '/' });

    } catch (error) {
      toast({
        title: "Submission failed",
        description: "There was an issue creating your meme.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    }
  };

  return (
    <Flex width="full" height="full">
      <Box flexGrow={1} height="full" p={4} overflowY="auto">
        <VStack spacing={5} align="stretch">
          <Box>
            <Heading as="h2" size="md" mb={2}>
              Upload your picture
            </Heading>
            <MemeEditor onDrop={handleDrop} memePicture={memePicture} />
          </Box>
          <Box>
            <Heading as="h2" size="md" mb={2}>
              Describe your meme
            </Heading>
            <Textarea
              placeholder="Type your description here..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Box>
        </VStack>
      </Box>
      <Flex
        flexDir="column"
        width="30%"
        minW="250"
        height="full"
        boxShadow="lg"
      >
        <Heading as="h2" size="md" mb={2} p={4}>
          Add your captions
        </Heading>
        <Box p={4} flexGrow={1} height={0} overflowY="auto">
          <VStack>
            {texts.map((text, index) => (
              <Flex width="full" key={`caption-${index}`}>
                <Input
                  value={text.content}
                  mr={1}
                  onChange={(e) => handleCaptionContentChange(index, e.target.value)}
                />
                <IconButton
                  onClick={() => handleDeleteCaptionButtonClick(index)}
                  aria-label="Delete caption"
                  icon={<Icon as={Trash} />}
                />
              </Flex>
            ))}
            <Button
              colorScheme="cyan"
              leftIcon={<Icon as={Plus} />}
              variant="ghost"
              size="sm"
              width="full"
              onClick={handleAddCaptionButtonClick}
              isDisabled={memePicture === undefined}
            >
              Add a caption
            </Button>
          </VStack>
        </Box>
        <HStack p={4}>
          <Button
            as={Link}
            to="/"
            colorScheme="cyan"
            variant="outline"
            size="sm"
            width="full"
          >
            Cancel
          </Button>
          <Button
            colorScheme="cyan"
            size="sm"
            width="full"
            color="white"
            isDisabled={!memePicture || !description}
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </HStack>
      </Flex>
    </Flex>
  );
}
