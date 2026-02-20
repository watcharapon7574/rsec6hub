import { useState, useCallback } from 'react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useNewsfeed } from '@/hooks/useNewsfeed';
import { Button } from '@/components/ui/button';
import { Newspaper, Loader2 } from 'lucide-react';
import NewsfeedHeader from '@/components/Newsfeed/NewsfeedHeader';
import NewsfeedPostCard from '@/components/Newsfeed/NewsfeedPostCard';
import NewsfeedSkeleton from '@/components/Newsfeed/NewsfeedSkeleton';
import NewsfeedCategoryFilter from '@/components/Newsfeed/NewsfeedCategoryFilter';
import NewsfeedSearchBar from '@/components/Newsfeed/NewsfeedSearchBar';

const getPositionText = (position: string) => {
  const positions: Record<string, string> = {
    'director': 'ผู้อำนวยการ',
    'deputy_director': 'รองผู้อำนวยการ',
    'assistant_director': 'หัวหน้าฝ่าย',
    'government_teacher': 'ข้าราชการครู',
    'government_employee': 'พนักงานราชการ',
    'contract_teacher': 'ครูอัตราจ้าง',
    'clerk_teacher': 'ครูธุรการ',
    'disability_aide': 'พี่เลี้ยงเด็กพิการ',
  };
  return positions[position] || position;
};

const NewsfeedPage = () => {
  const { profile } = useEmployeeAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    categories,
    stats,
    fetchMore,
    refetch,
    toggleReaction,
    addComment,
    deleteComment,
    acknowledgePost,
  } = useNewsfeed({ category: selectedCategory, search: searchQuery || undefined });

  const isDirector = profile?.position === 'director';

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = `${profile.first_name} ${profile.last_name}`;
  const userInfo = profile.job_position || profile.current_position || getPositionText(profile.position || '');

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header + Stats */}
        <NewsfeedHeader
          displayName={displayName}
          userInfo={userInfo}
          stats={stats}
          onRefresh={refetch}
        />

        {/* Search */}
        <div className="mb-3">
          <NewsfeedSearchBar onSearch={handleSearch} />
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-4">
            <NewsfeedCategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>
        )}

        {/* Search result count */}
        {searchQuery && !loading && (
          <p className="text-xs text-muted-foreground mb-3">
            พบ {posts.length} โพสต์{hasMore ? '+' : ''}
          </p>
        )}

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <NewsfeedSkeleton key={i} />)
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">
                {searchQuery ? 'ไม่พบโพสต์ที่ค้นหา' : 'ยังไม่มีโพสต์ในนิวส์ฟีด'}
              </p>
              <p className="text-sm mt-1">
                {searchQuery ? 'ลองค้นหาด้วยคำอื่น' : 'โพสต์ใหม่จะแสดงที่นี่'}
              </p>
            </div>
          ) : (
            posts.map(post => (
              <NewsfeedPostCard
                key={post.id}
                post={post}
                currentUserId={profile.user_id}
                isDirector={isDirector}
                onReaction={toggleReaction}
                onAddComment={addComment}
                onDeleteComment={deleteComment}
                onAcknowledge={acknowledgePost}
              />
            ))
          )}
        </div>

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={fetchMore}
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsfeedPage;
