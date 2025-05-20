import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Avatar,
  Box,
  Collapse,
  Flex,
  Icon,
  LinkBox,
  LinkOverlay,
  StackDivider,
  Text,
  Input,
  VStack,
  Spinner
} from "@chakra-ui/react";
import { CaretDown, CaretUp, Chat } from "@phosphor-icons/react";
import { format } from "timeago.js";
import {
  createMemeComment,
  getMemeComments,
  GetMemeCommentsResponse,
  getMemes,
  GetMemesResponse,
  getUserById,
  GetUserByIdResponse,
} from "../../api";
import { useAuthToken } from "../../contexts/authentication";
import { Loader } from "../../components/loader";
import { MemePicture } from "../../components/meme-picture";
import { useState, useRef, useEffect } from "react";
import { jwtDecode } from "jwt-decode";


// Component for comments section
const CommentsSection = ({ token, memeId, openedCommentSection, user }) => {
  const { data: commentsData, isLoading: isLoadingComments } = useQuery({
    queryKey: ["comments", memeId],
    queryFn: async () => {
      const firstPage = await getMemeComments(token, memeId, 1);
      const allComments = [...firstPage.results];

      const remainingPages = Math.ceil(firstPage.total / firstPage.pageSize) - 1;
      for (let i = 0; i < remainingPages; i++) {
        const page = await getMemeComments(token, memeId, i + 2);
        allComments.push(...page.results);
      }

      const commentsWithAuthors = await Promise.all(
        allComments.map(async (comment) => {
          const author = await getUserById(token, comment.authorId);
          return { ...comment, author };
        })
      );

      return commentsWithAuthors;
    },
    enabled: openedCommentSection === memeId,
  });

  return (
    <>
      {isLoadingComments ? (
        <Spinner />
      ) : (
        <VStack align="stretch" spacing={4}>
          {commentsData?.map((comment) => (
            <Flex key={comment.id}>
              <Avatar
                borderWidth="1px"
                borderColor="gray.300"
                size="sm"
                name={comment.author.username}
                src={comment.author.pictureUrl}
                mr={2}
              />
              <Box p={2} borderRadius={8} bg="gray.50" flexGrow={1}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Flex>
                    <Text data-testid={`meme-comment-author-${memeId}-${comment.id}`}>
                      {comment.author.username}
                    </Text>
                  </Flex>
                  <Text fontStyle="italic" color="gray.500" fontSize="small">
                    {format(comment.createdAt)}
                  </Text>
                </Flex>
                <Text color="gray.500" whiteSpace="pre-line" data-testid={`meme-comment-content-${memeId}-${comment.id}`}>
                  {comment.content}
                </Text>
              </Box>
            </Flex>
          ))}
        </VStack>
      )}
    </>
  );
};

export const MemeFeedPage: React.FC = () => {
  const token = useAuthToken();
  const observerTarget = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  const {
    data: memePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingMemes,
  } = useInfiniteQuery({
    queryKey: ["memes"],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const page = await getMemes(token, pageParam);

      // Fetch author for each meme in parallel
      const memesWithAuthor = await Promise.all(
        page.results.map(async (meme) => {
          const author = await getUserById(token, meme.authorId);
          return { ...meme, author };
        })
      );

      return {
        ...page,
        results: memesWithAuthor,
        currentPage: pageParam
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      // Calculate from the fetched data if there are more pages
      const currentPage = lastPage.currentPage;
      const totalItems = lastPage.total;
      const pageSize = lastPage.pageSize;
      const totalPages = Math.ceil(totalItems / pageSize);

      // Check if we've loaded all items
      const loadedItemCount = allPages.reduce((count, page) => count + page.results.length, 0);

      // Return the next page number or undefined if no more pages
      if (currentPage < totalPages && loadedItemCount < totalItems) {
        return currentPage + 1;
      } else {
        return undefined;
      }
    }
  });


  // Intersection observer to trigger loading more memes
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setIsIntersecting(entries[0].isIntersecting);
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log("Fetching next page");
          fetchNextPage();
        }
      },
      {
        threshold: 1
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      return await getUserById(token, jwtDecode<{ id: string }>(token).id);
    },
  });

  const [openedCommentSection, setOpenedCommentSection] = useState<
    string | null
  >(null);

  const [commentContent, setCommentContent] = useState<{
    [key: string]: string;
  }>({});

  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async (data: { memeId: string; content: string }) => {
      await createMemeComment(token, data.memeId, data.content);
    },
    onMutate: async (newComment) => {
      // Cancel any outgoing refetches for the target memeId
      await queryClient.cancelQueries({ queryKey: ["comments", newComment.memeId] });

      // Snapshot previous comments
      const previousComments = queryClient.getQueryData(["comments", newComment.memeId]);

      // Add optimistic comment
      queryClient.setQueryData(["comments", newComment.memeId], (old: any) => {
        if (!old) return [];
        return [
          ...old,
          {
            id: `temp-${Date.now()}`, // Temporary ID
            content: newComment.content,
            createdAt: new Date().toISOString(),
            author: user, // Use local user info
          },
        ];
      });

      // Clear the input
      setCommentContent((prev) => ({
        ...prev,
        [newComment.memeId]: '',
      }));

      return { previousComments };
    },
    onError: (_err, newComment, context) => {
      // Roll back to previous state
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", newComment.memeId], context.previousComments);
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to get the actual server-side comment
      queryClient.invalidateQueries({ queryKey: ["comments", variables.memeId] });
    },
  });

  if (isLoadingMemes && !memePages) {
    return <Loader data-testid="meme-feed-loader" />;
  }

  // Flatten all pages into a single array of memes
  const memes = memePages?.pages.flatMap(page => page.results) || [];

  return (
    <Flex width="full" height="full" justifyContent="center">
      <VStack
        p={4}
        width="full"
        maxWidth={800}
        divider={<StackDivider border="gray.200" />}
        spacing={4}
      >
        {memes?.map((meme) => {

          return (
            <VStack key={meme.id} p={4} width="full" align="stretch">
              <Flex justifyContent="space-between" alignItems="center">
                <Flex>
                  <Avatar
                    borderWidth="1px"
                    borderColor="gray.300"
                    size="xs"
                    name={meme.author.username}
                    src={meme.author.pictureUrl}
                  />
                  <Text ml={2} data-testid={`meme-author-${meme.id}`}>{meme.author.username}</Text>
                </Flex>
                <Text fontStyle="italic" color="gray.500" fontSize="small">
                  {format(meme.createdAt)}
                </Text>
              </Flex>
              <MemePicture pictureUrl={meme.pictureUrl} texts={meme.texts} dataTestId={`meme-picture-${meme.id}`} />
              <Box>
                <Text fontWeight="bold" fontSize="medium" mb={2}>
                  Description:{" "}
                </Text>
                <Box
                  p={2}
                  borderRadius={8}
                  border="1px solid"
                  borderColor="gray.100"
                >
                  <Text color="gray.500" whiteSpace="pre-line" data-testid={`meme-description-${meme.id}`}>
                    {meme.description}
                  </Text>
                </Box>
              </Box>
              <LinkBox as={Box} py={2} borderBottom="1px solid black">
                <Flex justifyContent="space-between" alignItems="center">
                  <Flex alignItems="center">
                    <LinkOverlay
                      data-testid={`meme-comments-section-${meme.id}`}
                      cursor="pointer"
                      onClick={() =>
                        setOpenedCommentSection(
                          openedCommentSection === meme.id ? null : meme.id,
                        )
                      }
                    >
                      <Text data-testid={`meme-comments-count-${meme.id}`}>{meme.commentsCount} comments</Text>
                    </LinkOverlay>
                    <Icon
                      as={
                        openedCommentSection !== meme.id ? CaretDown : CaretUp
                      }
                      ml={2}
                      mt={1}
                    />
                  </Flex>
                  <Icon as={Chat} />
                </Flex>
              </LinkBox>
              <Collapse in={openedCommentSection === meme.id} animateOpacity>
                <Box mb={6}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (commentContent[meme.id]) {
                        mutate({
                          memeId: meme.id,
                          content: commentContent[meme.id],
                        });
                      }
                    }}
                  >
                    <Flex alignItems="center">
                      <Avatar
                        borderWidth="1px"
                        borderColor="gray.300"
                        name={user?.username}
                        src={user?.pictureUrl}
                        size="sm"
                        mr={2}
                      />
                      <Input
                        placeholder="Type your comment here..."
                        onChange={(event) => {
                          setCommentContent({
                            ...commentContent,
                            [meme.id]: event.target.value,
                          });
                        }}
                        value={commentContent[meme.id] || ''}
                      />
                    </Flex>
                  </form>
                </Box>
                <CommentsSection
                  token={token}
                  memeId={meme.id}
                  openedCommentSection={openedCommentSection}
                  user={user}
                />
              </Collapse>
            </VStack>
          );
        })}

        {/* Loading indicator and observer target */}
        <Flex direction="column" width="full" align="center" py={4}>
          {isFetchingNextPage && <Spinner size="lg" mb={4} />}
          <Box
            ref={observerTarget}
            width="full"
            height="100px"  // Give it a fixed height to ensure visibility
            my={4}
            p={4}
            textAlign="center"
            border="1px dashed"
            borderColor="gray.300"
            borderRadius="md"
            display={hasNextPage ? "block" : "none"}  // Only show if there are more pages
          >
            {hasNextPage && !isFetchingNextPage && (
              <Text color="gray.500">Scroll for more</Text>
            )}
          </Box>
        </Flex>
      </VStack>
    </Flex>
  );
};

export const Route = createFileRoute("/_authentication/")({
  component: MemeFeedPage,
});
