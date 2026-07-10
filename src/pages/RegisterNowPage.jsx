import React from 'react';
import RegisterNowTab from '@/components/RegisterNowTab';
import { motion } from 'framer-motion';

const RegisterNowPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Hero Section */}
            <div className="relative h-[300px] w-full bg-[#003D82] overflow-hidden">
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
                    style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1693045181224-9fc2f954f054")' }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#003D82] via-transparent to-transparent"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center text-white z-10">
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2"
                    >
                        Register Now
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg md:text-xl text-blue-100 max-w-2xl"
                    >
                        Join Alpha Bridge and elevate your skills with our premium courses. Select your courses below to get started.
                    </motion.p>
                </div>
            </div>

            {/* Content Section */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 z-20 pb-16 w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <RegisterNowTab />
                </motion.div>
            </main>
        </div>
    );
};

export default RegisterNowPage;